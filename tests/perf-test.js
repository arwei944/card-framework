const fs = require('fs');
const path = require('path');

const frameworkCode = fs.readFileSync(
  path.join(__dirname, '../src/card-framework.js'),
  'utf8'
);

function createMockBrowser() {
  const mockElements = new Map();
  let elementIdCounter = 0;

  class MockNode {
    constructor() {
      this.parentNode = null;
      this.childNodes = [];
      this.nodeType = 1;
    }
  }

  class MockElement extends MockNode {
    constructor(tagName) {
      super();
      this.tagName = tagName.toUpperCase();
      this.children = [];
      this.attributes = {};
      this.style = {};
      this.dataset = {};
      this.classList = {
        add: () => {},
        remove: () => {},
        contains: () => false,
        toggle: () => {}
      };
      this.textContent = '';
      this.innerHTML = '';
      this.id = '';
      this._mockId = ++elementIdCounter;
    }

    addEventListener() {}
    removeEventListener() {}

    setAttribute(name, value) {
      this.attributes[name] = value;
    }

    getAttribute(name) {
      return this.attributes[name] || null;
    }

    removeAttribute(name) {
      delete this.attributes[name];
    }

    hasAttribute(name) {
      return name in this.attributes;
    }

    querySelector() { return null; }
    querySelectorAll() { return []; }
    getElementsByTagName() { return []; }

    getBoundingClientRect() {
      return { left: 0, top: 0, width: 200, height: 150, right: 200, bottom: 150 };
    }

    appendChild(child) {
      if (child.parentNode) {
        const idx = child.parentNode.children.indexOf(child);
        if (idx > -1) child.parentNode.children.splice(idx, 1);
      }
      child.parentNode = this;
      this.children.push(child);
      this.childNodes.push(child);
      return child;
    }

    insertBefore(child, ref) {
      if (child.parentNode) {
        const idx = child.parentNode.children.indexOf(child);
        if (idx > -1) child.parentNode.children.splice(idx, 1);
      }
      child.parentNode = this;
      const refIdx = this.children.indexOf(ref);
      if (refIdx > -1) {
        this.children.splice(refIdx, 0, child);
        this.childNodes.splice(refIdx, 0, child);
      } else {
        this.children.unshift(child);
        this.childNodes.unshift(child);
      }
      return child;
    }

    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx > -1) {
        this.children.splice(idx, 1);
        this.childNodes.splice(idx, 1);
      }
      child.parentNode = null;
      return child;
    }

    remove() {
      if (this.parentNode) {
        this.parentNode.removeChild(this);
      }
    }

    closest() { return null; }
  }

  class MockHTMLElement extends MockElement {
    constructor(tagName) {
      super(tagName);
    }
  }

  function createMockElement(tagName) {
    const el = new MockHTMLElement(tagName);
    mockElements.set(el._mockId, el);
    return el;
  }

  const mockDocument = {
    createElement: (tag) => createMockElement(tag),
    createElementNS: (ns, tag) => createMockElement(tag),
    createTextNode: (text) => ({
      nodeType: 3,
      textContent: text,
      parentNode: null
    }),
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    getElementsByTagName: () => [],
    body: createMockElement('body'),
    documentElement: createMockElement('html'),
    createDocumentFragment: () => createMockElement('fragment'),
    addEventListener: () => {},
    removeEventListener: () => {},
    defaultView: null
  };

  mockDocument.body.ownerDocument = mockDocument;

  const mockWindow = {
    document: mockDocument,
    location: { origin: 'http://localhost' },
    navigator: { language: 'zh-CN', userLanguage: 'zh-CN' },
    matchMedia: () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {}
    }),
    addEventListener: () => {},
    removeEventListener: () => {},
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: (id) => clearTimeout(id),
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout,
    console,
    URL: global.URL || require('url').URL,
    customElements: undefined,
    MutationObserver: undefined
  };

  mockWindow.defaultView = mockWindow;
  mockDocument.defaultView = mockWindow;

  return { window: mockWindow, document: mockDocument, createMockElement };
}

function loadFramework() {
  const mock = createMockBrowser();

  class MockNode {
    constructor() {
      this.parentNode = null;
      this.childNodes = [];
      this.nodeType = 1;
    }
  }

  class MockElement extends MockNode {
    constructor(tagName) {
      super();
      this.tagName = tagName.toUpperCase();
      this.children = [];
      this.attributes = {};
      this.style = {};
      this.dataset = {};
      this.classList = {
        add: () => {},
        remove: () => {},
        contains: () => false,
        toggle: () => {}
      };
      this.textContent = '';
      this.innerHTML = '';
      this.id = '';
    }
    addEventListener() {}
    removeEventListener() {}
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return this.attributes[name] || null; }
    removeAttribute(name) { delete this.attributes[name]; }
    hasAttribute(name) { return name in this.attributes; }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    getElementsByTagName() { return []; }
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 200, height: 150, right: 200, bottom: 150 };
    }
    appendChild(child) {
      if (child.parentNode) {
        const idx = child.parentNode.children.indexOf(child);
        if (idx > -1) child.parentNode.children.splice(idx, 1);
      }
      child.parentNode = this;
      this.children.push(child);
      this.childNodes.push(child);
      return child;
    }
    insertBefore(child, ref) {
      if (child.parentNode) {
        const idx = child.parentNode.children.indexOf(child);
        if (idx > -1) child.parentNode.children.splice(idx, 1);
      }
      child.parentNode = this;
      const refIdx = this.children.indexOf(ref);
      if (refIdx > -1) {
        this.children.splice(refIdx, 0, child);
        this.childNodes.splice(refIdx, 0, child);
      } else {
        this.children.unshift(child);
        this.childNodes.unshift(child);
      }
      return child;
    }
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx > -1) {
        this.children.splice(idx, 1);
        this.childNodes.splice(idx, 1);
      }
      child.parentNode = null;
      return child;
    }
    remove() {
      if (this.parentNode) this.parentNode.removeChild(this);
    }
    closest() { return null; }
  }

  class MockHTMLElement extends MockElement {
    constructor(tagName) {
      super(tagName);
    }
  }

  const sandbox = {
    window: mock.window,
    document: mock.document,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    performance: {
      now: () => Number(process.hrtime.bigint() / 1000000n)
    },
    MutationObserver: undefined,
    customElements: undefined,
    HTMLElement: MockHTMLElement,
    Element: MockElement,
    Node: MockNode
  };

  mock.window.HTMLElement = MockHTMLElement;
  mock.window.Element = MockElement;
  mock.window.Node = MockNode;

  const wrappedCode = `
    ${frameworkCode}
    return window.CardFrame;
  `;

  const fn = new Function(...Object.keys(sandbox), wrappedCode);
  const CardFrame = fn(...Object.values(sandbox));
  return { CardFrame, mock };
}

const { CardFrame } = loadFramework();

const {
  Store,
  TypeRegistry,
  EventBus,
  Utils,
  Security
} = CardFrame;

const benchmarks = {
  store_addCard: { name: 'Store - addCard (1000次)', threshold: 50, unit: 'ms' },
  store_getCard: { name: 'Store - getCard (1000次)', threshold: 10, unit: 'ms' },
  store_updateCard: { name: 'Store - updateCard (1000次)', threshold: 30, unit: 'ms' },
  store_removeCard: { name: 'Store - removeCard (1000次)', threshold: 30, unit: 'ms' },
  store_getAllCards: { name: 'Store - getAllCards (1000次)', threshold: 30, unit: 'ms' },
  store_getCardsByType: { name: 'Store - getCardsByType (1000次)', threshold: 100, unit: 'ms' },
  utils_generateId: { name: 'Utils - generateId (1000次)', threshold: 10, unit: 'ms' },
  utils_deepClone: { name: 'Utils - deepClone (1000次)', threshold: 20, unit: 'ms' },
  utils_validateType: { name: 'Utils - validateType (1000次)', threshold: 10, unit: 'ms' },
  utils_parseValue: { name: 'Utils - parseValue (1000次)', threshold: 100, unit: 'ms' },
  typeRegistry_register: { name: 'TypeRegistry - register (100次)', threshold: 30, unit: 'ms' },
  typeRegistry_validate: { name: 'TypeRegistry - validate (1000次)', threshold: 50, unit: 'ms' },
  eventBus_emit: { name: 'EventBus - emit (1000次)', threshold: 20, unit: 'ms' },
  eventBus_on_emit: { name: 'EventBus - on+emit (1000次)', threshold: 30, unit: 'ms' },
  security_escapeHtml: { name: 'Security - escapeHtml (1000次)', threshold: 30, unit: 'ms' },
  security_sanitizeUrl: { name: 'Security - sanitizeUrl (1000次)', threshold: 30, unit: 'ms' }
};

const results = {};

function measure(name, fn, iterations) {
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    fn(i);
  }
  const end = process.hrtime.bigint();
  const durationMs = Number(end - start) / 1000000;
  const avgMs = durationMs / iterations;
  return { total: durationMs, avg: avgMs, iterations };
}

function runBenchmark(key, fn, iterations) {
  const bench = benchmarks[key];
  const result = measure(key, fn, iterations);
  results[key] = {
    ...bench,
    ...result,
    pass: result.total <= bench.threshold
  };
  return results[key];
}

console.log('='.repeat(60));
console.log('  CardFrame 性能测试报告');
console.log('='.repeat(60));
console.log('');

console.log('--- Store CRUD 性能测试 ---');
console.log('');

const store = new Store();
const testCards = [];
for (let i = 0; i < 1000; i++) {
  testCards.push({
    id: `card_${i}`,
    type: i % 3 === 0 ? 'text' : i % 3 === 1 ? 'task' : 'image',
    props: { title: `卡片 ${i}`, content: `内容 ${i}` },
    position: { x: i * 10, y: (i % 10) * 100 },
    status: 'active'
  });
}

runBenchmark('store_addCard', (i) => {
  store.addCard({ ...testCards[i] });
}, 1000);
console.log(`  ${results.store_addCard.name}`);
console.log(`    总耗时: ${results.store_addCard.total.toFixed(3)} ms`);
console.log(`    平均耗时: ${results.store_addCard.avg.toFixed(6)} ms`);
console.log(`    基准值: ${results.store_addCard.threshold} ms`);
console.log(`    结果: ${results.store_addCard.pass ? '✅ PASS' : '❌ FAIL'}`);
console.log('');

runBenchmark('store_getCard', (i) => {
  store.getCard(`card_${i}`);
}, 1000);
console.log(`  ${results.store_getCard.name}`);
console.log(`    总耗时: ${results.store_getCard.total.toFixed(3)} ms`);
console.log(`    平均耗时: ${results.store_getCard.avg.toFixed(6)} ms`);
console.log(`    基准值: ${results.store_getCard.threshold} ms`);
console.log(`    结果: ${results.store_getCard.pass ? '✅ PASS' : '❌ FAIL'}`);
console.log('');

runBenchmark('store_updateCard', (i) => {
  const card = store.getCard(`card_${i}`);
  card.props.title = `更新后的卡片 ${i}`;
  store.updateCard(card);
}, 1000);
console.log(`  ${results.store_updateCard.name}`);
console.log(`    总耗时: ${results.store_updateCard.total.toFixed(3)} ms`);
console.log(`    平均耗时: ${results.store_updateCard.avg.toFixed(6)} ms`);
console.log(`    基准值: ${results.store_updateCard.threshold} ms`);
console.log(`    结果: ${results.store_updateCard.pass ? '✅ PASS' : '❌ FAIL'}`);
console.log('');

runBenchmark('store_getAllCards', () => {
  store.getAllCards();
}, 1000);
console.log(`  ${results.store_getAllCards.name}`);
console.log(`    总耗时: ${results.store_getAllCards.total.toFixed(3)} ms`);
console.log(`    平均耗时: ${results.store_getAllCards.avg.toFixed(6)} ms`);
console.log(`    基准值: ${results.store_getAllCards.threshold} ms`);
console.log(`    结果: ${results.store_getAllCards.pass ? '✅ PASS' : '❌ FAIL'}`);
console.log('');

runBenchmark('store_getCardsByType', () => {
  store.getCardsByType('text');
}, 1000);
console.log(`  ${results.store_getCardsByType.name}`);
console.log(`    总耗时: ${results.store_getCardsByType.total.toFixed(3)} ms`);
console.log(`    平均耗时: ${results.store_getCardsByType.avg.toFixed(6)} ms`);
console.log(`    基准值: ${results.store_getCardsByType.threshold} ms`);
console.log(`    结果: ${results.store_getCardsByType.pass ? '✅ PASS' : '❌ FAIL'}`);
console.log('');

runBenchmark('store_removeCard', (i) => {
  store.removeCard(`card_${i}`);
}, 1000);
console.log(`  ${results.store_removeCard.name}`);
console.log(`    总耗时: ${results.store_removeCard.total.toFixed(3)} ms`);
console.log(`    平均耗时: ${results.store_removeCard.avg.toFixed(6)} ms`);
console.log(`    基准值: ${results.store_removeCard.threshold} ms`);
console.log(`    结果: ${results.store_removeCard.pass ? '✅ PASS' : '❌ FAIL'}`);
console.log('');

console.log('--- Utils 工具函数性能测试 ---');
console.log('');

runBenchmark('utils_generateId', () => {
  Utils.generateId();
}, 1000);
console.log(`  ${results.utils_generateId.name}`);
console.log(`    总耗时: ${results.utils_generateId.total.toFixed(3)} ms`);
console.log(`    平均耗时: ${results.utils_generateId.avg.toFixed(6)} ms`);
console.log(`    基准值: ${results.utils_generateId.threshold} ms`);
console.log(`    结果: ${results.utils_generateId.pass ? '✅ PASS' : '❌ FAIL'}`);
console.log('');

const cloneObj = {
  id: 'test',
  type: 'text',
  props: { title: '测试', content: '内容', tags: ['a', 'b', 'c'] },
  position: { x: 10, y: 20 },
  metadata: { created: Date.now(), updated: Date.now() }
};

runBenchmark('utils_deepClone', () => {
  Utils.deepClone(cloneObj);
}, 1000);
console.log(`  ${results.utils_deepClone.name}`);
console.log(`    总耗时: ${results.utils_deepClone.total.toFixed(3)} ms`);
console.log(`    平均耗时: ${results.utils_deepClone.avg.toFixed(6)} ms`);
console.log(`    基准值: ${results.utils_deepClone.threshold} ms`);
console.log(`    结果: ${results.utils_deepClone.pass ? '✅ PASS' : '❌ FAIL'}`);
console.log('');

const testValues = [
  'hello', 123, true, [1, 2, 3], { a: 1 }, '2024-01-01', '', null, undefined
];

runBenchmark('utils_validateType', (i) => {
  const val = testValues[i % testValues.length];
  Utils.validateType(val, 'string');
  Utils.validateType(val, 'number');
  Utils.validateType(val, 'boolean');
}, 1000);
console.log(`  ${results.utils_validateType.name}`);
console.log(`    总耗时: ${results.utils_validateType.total.toFixed(3)} ms`);
console.log(`    平均耗时: ${results.utils_validateType.avg.toFixed(6)} ms`);
console.log(`    基准值: ${results.utils_validateType.threshold} ms`);
console.log(`    结果: ${results.utils_validateType.pass ? '✅ PASS' : '❌ FAIL'}`);
console.log('');

runBenchmark('utils_parseValue', (i) => {
  Utils.parseValue('123', 'number');
  Utils.parseValue('true', 'boolean');
  Utils.parseValue('a,b,c', 'array');
  Utils.parseValue('{"a":1}', 'object');
}, 1000);
console.log(`  ${results.utils_parseValue.name}`);
console.log(`    总耗时: ${results.utils_parseValue.total.toFixed(3)} ms`);
console.log(`    平均耗时: ${results.utils_parseValue.avg.toFixed(6)} ms`);
console.log(`    基准值: ${results.utils_parseValue.threshold} ms`);
console.log(`    结果: ${results.utils_parseValue.pass ? '✅ PASS' : '❌ FAIL'}`);
console.log('');

console.log('--- TypeRegistry 类型验证性能测试 ---');
console.log('');

const typeRegistry = new TypeRegistry();

const typeDefs = [];
for (let i = 0; i < 100; i++) {
  typeDefs.push({
    type: `custom_type_${i}`,
    label: `自定义类型 ${i}`,
    propsSchema: [
      { name: 'title', type: 'string', required: true },
      { name: 'content', type: 'string' },
      { name: 'count', type: 'number', defaultValue: 0 },
      { name: 'enabled', type: 'boolean', defaultValue: false }
    ]
  });
}

runBenchmark('typeRegistry_register', (i) => {
  const tr = new TypeRegistry();
  for (let j = 0; j < i + 1; j++) {
    tr.register(typeDefs[j]);
  }
}, 100);
console.log(`  ${results.typeRegistry_register.name}`);
console.log(`    总耗时: ${results.typeRegistry_register.total.toFixed(3)} ms`);
console.log(`    平均耗时: ${results.typeRegistry_register.avg.toFixed(6)} ms`);
console.log(`    基准值: ${results.typeRegistry_register.threshold} ms`);
console.log(`    结果: ${results.typeRegistry_register.pass ? '✅ PASS' : '❌ FAIL'}`);
console.log('');

const validateRegistry = new TypeRegistry();
validateRegistry.register({
  type: 'test_type',
  propsSchema: [
    { name: 'title', type: 'string', required: true },
    { name: 'content', type: 'string' },
    { name: 'count', type: 'number', defaultValue: 0 },
    { name: 'enabled', type: 'boolean', defaultValue: false },
    { name: 'status', type: 'string', allowedValues: ['active', 'inactive', 'archived'] }
  ]
});

const validateCards = [];
for (let i = 0; i < 1000; i++) {
  validateCards.push({
    id: `vcard_${i}`,
    type: 'test_type',
    props: {
      title: `标题 ${i}`,
      content: `内容 ${i}`,
      count: i,
      enabled: i % 2 === 0,
      status: ['active', 'inactive', 'archived'][i % 3]
    }
  });
}

runBenchmark('typeRegistry_validate', (i) => {
  validateRegistry.validate(validateCards[i % validateCards.length]);
}, 1000);
console.log(`  ${results.typeRegistry_validate.name}`);
console.log(`    总耗时: ${results.typeRegistry_validate.total.toFixed(3)} ms`);
console.log(`    平均耗时: ${results.typeRegistry_validate.avg.toFixed(6)} ms`);
console.log(`    基准值: ${results.typeRegistry_validate.threshold} ms`);
console.log(`    结果: ${results.typeRegistry_validate.pass ? '✅ PASS' : '❌ FAIL'}`);
console.log('');

console.log('--- EventBus 事件总线性能测试 ---');
console.log('');

const eventBus = new EventBus.constructor();

runBenchmark('eventBus_emit', (i) => {
  eventBus.emit(`test_event_${i % 10}`, { data: i });
}, 1000);
console.log(`  ${results.eventBus_emit.name}`);
console.log(`    总耗时: ${results.eventBus_emit.total.toFixed(3)} ms`);
console.log(`    平均耗时: ${results.eventBus_emit.avg.toFixed(6)} ms`);
console.log(`    基准值: ${results.eventBus_emit.threshold} ms`);
console.log(`    结果: ${results.eventBus_emit.pass ? '✅ PASS' : '❌ FAIL'}`);
console.log('');

const eventBus2 = new EventBus.constructor();
for (let i = 0; i < 10; i++) {
  eventBus2.on(`event_${i}`, () => {});
}

runBenchmark('eventBus_on_emit', (i) => {
  eventBus2.emit(`event_${i % 10}`, { data: i });
}, 1000);
console.log(`  ${results.eventBus_on_emit.name}`);
console.log(`    总耗时: ${results.eventBus_on_emit.total.toFixed(3)} ms`);
console.log(`    平均耗时: ${results.eventBus_on_emit.avg.toFixed(6)} ms`);
console.log(`    基准值: ${results.eventBus_on_emit.threshold} ms`);
console.log(`    结果: ${results.eventBus_on_emit.pass ? '✅ PASS' : '❌ FAIL'}`);
console.log('');

console.log('--- Security 安全模块性能测试 ---');
console.log('');

const htmlStrings = [
  '<div>Hello World</div>',
  '<p>这是一段<strong>富文本</strong>内容</p>',
  '<script>alert("xss")</script><div>safe</div>',
  '<a href="javascript:alert(1)">点击</a>',
  '<img src="test.jpg" onerror="alert(1)">',
  '<div style="color: red; expression(alert(1))">test</div>'
];

runBenchmark('security_escapeHtml', (i) => {
  Utils.escapeHtml(htmlStrings[i % htmlStrings.length]);
}, 1000);
console.log(`  ${results.security_escapeHtml.name}`);
console.log(`    总耗时: ${results.security_escapeHtml.total.toFixed(3)} ms`);
console.log(`    平均耗时: ${results.security_escapeHtml.avg.toFixed(6)} ms`);
console.log(`    基准值: ${results.security_escapeHtml.threshold} ms`);
console.log(`    结果: ${results.security_escapeHtml.pass ? '✅ PASS' : '❌ FAIL'}`);
console.log('');

const urlStrings = [
  'http://example.com',
  'https://example.com/path?query=1',
  'javascript:alert(1)',
  'ftp://files.example.com',
  '/relative/path',
  '#anchor',
  'data:text/html,<script>alert(1)</script>'
];

runBenchmark('security_sanitizeUrl', (i) => {
  Security.sanitizeUrl(urlStrings[i % urlStrings.length]);
}, 1000);
console.log(`  ${results.security_sanitizeUrl.name}`);
console.log(`    总耗时: ${results.security_sanitizeUrl.total.toFixed(3)} ms`);
console.log(`    平均耗时: ${results.security_sanitizeUrl.avg.toFixed(6)} ms`);
console.log(`    基准值: ${results.security_sanitizeUrl.threshold} ms`);
console.log(`    结果: ${results.security_sanitizeUrl.pass ? '✅ PASS' : '❌ FAIL'}`);
console.log('');

console.log('='.repeat(60));
console.log('  性能测试汇总');
console.log('='.repeat(60));
console.log('');

const allResults = Object.values(results);
const passed = allResults.filter(r => r.pass).length;
const failed = allResults.filter(r => !r.pass).length;

console.log(`  总测试项: ${allResults.length}`);
console.log(`  通过: ${passed} ✅`);
console.log(`  失败: ${failed} ❌`);
console.log(`  通过率: ${((passed / allResults.length) * 100).toFixed(1)}%`);
console.log('');

if (failed > 0) {
  console.log('  失败项:');
  allResults.filter(r => !r.pass).forEach(r => {
    console.log(`    - ${r.name}: ${r.total.toFixed(3)} ms (基准: ${r.threshold} ms)`);
  });
  console.log('');
}

console.log('='.repeat(60));
console.log(`  整体结果: ${failed === 0 ? '✅ ALL PASSED' : '❌ SOME FAILED'}`);
console.log('='.repeat(60));

process.exit(failed === 0 ? 0 : 1);
