/**
 * Phase 6 — security hardening tests.
 * Covers sanitizeUrl protocol whitelist, sanitizeScriptContent, sanitizeStyle
 * lastIndex robustness, isSafeUrl protocol-relative fix, CSP support, and
 * tooltip XSS.
 */

const { assert, getModule, createFrame, cleanupFrame } = require('../helpers');

describe('Phase 6 — sanitizeUrl', function() {
  let Security;
  before(function() { Security = getModule().Security; });

  it('returns "" for null/undefined/empty', function() {
    assert.strictEqual(Security.sanitizeUrl(null), '');
    assert.strictEqual(Security.sanitizeUrl(undefined), '');
    assert.strictEqual(Security.sanitizeUrl(''), '');
  });

  it('rejects javascript: / vbscript:', function() {
    assert.strictEqual(Security.sanitizeUrl('javascript:alert(1)'), '');
    assert.strictEqual(Security.sanitizeUrl('vbscript:alert(1)'), '');
  });

  it('rejects case-obfuscated javascript protocol', function() {
    assert.strictEqual(Security.sanitizeUrl('JaVaScRiPt:alert(1)'), '');
  });

  it('rejects null-byte bypass', function() {
    assert.strictEqual(Security.sanitizeUrl('java\u0000script:alert(1)'), '');
  });

  it('rejects data:text/html', function() {
    assert.strictEqual(Security.sanitizeUrl('data:text/html,<script>alert(1)</script>'), '');
  });

  it('rejects data:application/javascript', function() {
    assert.strictEqual(Security.sanitizeUrl('data:application/javascript,alert(1)'), '');
  });

  it('accepts data:image/png', function() {
    const url = 'data:image/png;base64,iVBORw0KGgo=';
    assert.strictEqual(Security.sanitizeUrl(url), url);
  });

  it('accepts https and mailto and tel', function() {
    assert.strictEqual(Security.sanitizeUrl('https://example.com'), 'https://example.com');
    assert.strictEqual(Security.sanitizeUrl('mailto:test@example.com'), 'mailto:test@example.com');
    assert.strictEqual(Security.sanitizeUrl('tel:+123'), 'tel:+123');
  });

  it('does not throw on garbage input', function() {
    assert.doesNotThrow(() => Security.sanitizeUrl('not a url'));
  });
});

describe('Phase 6 — isSafeUrl', function() {
  let Security;
  before(function() { Security = getModule().Security; });

  it('rejects protocol-relative //evil.com', function() {
    assert.strictEqual(Security.isSafeUrl('//evil.com'), false);
  });

  it('accepts absolute path', function() {
    assert.strictEqual(Security.isSafeUrl('/path/to/resource'), true);
  });

  it('accepts relative paths', function() {
    assert.strictEqual(Security.isSafeUrl('./relative'), true);
    assert.strictEqual(Security.isSafeUrl('../relative'), true);
  });

  it('accepts fragment', function() {
    assert.strictEqual(Security.isSafeUrl('#anchor'), true);
  });
});

describe('Phase 6 — sanitizeScriptContent', function() {
  let Security;
  before(function() { Security = getModule().Security; });

  it('removes cross-line <script> blocks', function() {
    const out = Security.sanitizeScriptContent('a<script>\nalert(1)\n</script>b');
    assert.strictEqual(out.toLowerCase().indexOf('<script'), -1);
    assert.strictEqual(out.toLowerCase().indexOf('alert'), -1);
  });

  it('removes unclosed <script> tags', function() {
    const out = Security.sanitizeScriptContent('safe<script>alert(1)');
    assert.strictEqual(out.toLowerCase().indexOf('<script'), -1);
  });

  it('removes inline event handlers', function() {
    const out = Security.sanitizeScriptContent('<div onclick="x()" onerror=\'y()\' onload=z>hi</div>');
    assert.strictEqual(/onclick|onerror|onload/i.test(out), false);
  });

  it('removes javascript: protocol', function() {
    const out = Security.sanitizeScriptContent('<a href="javascript:alert(1)">x</a>');
    assert.strictEqual(out.toLowerCase().indexOf('javascript:'), -1);
  });
});

describe('Phase 6 — sanitizeStyle robustness', function() {
  let Security;
  before(function() { Security = getModule().Security; });

  it('removes expression()', function() {
    const out = Security.sanitizeStyle('color: red; expression(alert(1))');
    assert.strictEqual(out.toLowerCase().indexOf('expression'), -1);
  });

  it('removes url(javascript:)', function() {
    const out = Security.sanitizeStyle('background: url(javascript:alert(1))');
    assert.strictEqual(out.toLowerCase().indexOf('javascript:'), -1);
  });

  it('removes -moz-binding', function() {
    const out = Security.sanitizeStyle('-moz-binding: url(evil.xml)');
    assert.strictEqual(out.toLowerCase().indexOf('-moz-binding'), -1);
  });

  it('produces identical results across repeated calls (no lastIndex leak)', function() {
    const input = 'color: red; expression(alert(1))';
    const first = Security.sanitizeStyle(input);
    const second = Security.sanitizeStyle(input);
    const third = Security.sanitizeStyle(input);
    assert.strictEqual(first, second);
    assert.strictEqual(second, third);
  });
});

describe('Phase 6 — checkTemplateSecurity attack vectors', function() {
  let Security;
  before(function() { Security = getModule().Security; });

  function unsafe(tpl) { return Security.checkTemplateSecurity(tpl).safe === false; }

  it('flags <script> injection', function() { assert.ok(unsafe('<script>alert(1)</script>')); });
  it('flags <img onerror>', function() { assert.ok(unsafe('<img src=x onerror=alert(1)>')); });
  it('flags <svg onload>', function() { assert.ok(unsafe('<svg onload=alert(1)>')); });
  it('flags javascript: url', function() { assert.ok(unsafe('<a href="javascript:alert(1)">x</a>')); });
  it('flags vbscript: url', function() { assert.ok(unsafe('<a href="vbscript:msgbox(1)">x</a>')); });
  it('flags css expression()', function() { assert.ok(unsafe('<div style="width:expression(alert(1))">x</div>')); });
  it('flags data: url in css', function() { assert.ok(unsafe('<div style="background:url(data:text/html,x)">x</div>')); });
  it('flags iframe', function() { assert.ok(unsafe('<iframe src="x"></iframe>')); });
});

describe('Phase 6 — CSP support', function() {
  let CardFrame;
  before(function() { CardFrame = getModule().CardFrame; });
  afterEach(function() {
    const m = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (m && m.parentNode) m.parentNode.removeChild(m);
  });

  it('adds a CSP meta tag via options.csp', function() {
    let frame, container;
    ({ frame, container } = createFrame({ csp: "default-src 'self'" }));
    const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    assert.ok(meta);
    assert.strictEqual(meta.getAttribute('content'), "default-src 'self'");
    cleanupFrame(frame, container);
  });

  it('does not overwrite an existing CSP meta', function() {
    const existing = document.createElement('meta');
    existing.setAttribute('http-equiv', 'Content-Security-Policy');
    existing.setAttribute('content', "default-src 'none'");
    document.head.appendChild(existing);
    let frame, container;
    ({ frame, container } = createFrame({ csp: "default-src 'self'" }));
    const metas = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
    assert.strictEqual(metas.length, 1);
    assert.strictEqual(metas[0].getAttribute('content'), "default-src 'none'");
    cleanupFrame(frame, container);
  });

  it('reports CSP compatibility without eval probe', function() {
    const result = getModule().Security.checkCSPCompatibility();
    assert.strictEqual(typeof result.compatible, 'boolean');
    assert.ok(Array.isArray(result.notes));
  });
});

describe('Phase 6 — tooltip XSS', function() {
  let RelationshipEngine, EventBus, Store;
  before(function() {
    const CF = getModule();
    RelationshipEngine = CF.RelationshipEngine;
    EventBus = CF.EventBus;
    Store = CF.Store;
  });

  it('escapes malicious card titles and relationship type in tooltip', function() {
    const bus = new EventBus();
    const store = new Store(bus);
    store.addCard({ id: 's', type: 'text', props: { title: '<img src=x onerror=alert(1)>' }, position: { x: 0, y: 0 } });
    store.addCard({ id: 't', type: 'text', props: { title: 'ok' }, position: { x: 0, y: 0 } });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const engine = new RelationshipEngine(container, store, bus);
    const rel = { id: 'r1', sourceId: 's', targetId: 't', type: '<svg onload=alert(1)>' };

    engine._showRelationshipTooltip(rel, { clientX: 0, clientY: 0 });
    const tip = document.querySelector('.relationship-tooltip');
    assert.ok(tip);
    assert.strictEqual(tip.querySelector('img'), null);
    assert.strictEqual(tip.querySelector('svg'), null);
    engine._hideRelationshipTooltip();
    if (container.parentNode) container.parentNode.removeChild(container);
  });
});
