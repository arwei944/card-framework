/**
 * Phase 5 — plugin hardening: sandbox, permissions, uninstall cleanup,
 * hook priority, action registration, exception isolation.
 */

const { assert, getModule, createFrame, cleanupFrame } = require('../helpers');

describe('Phase 5 — Plugin Sandbox', function() {
  let PluginSandbox, EventBus;

  before(function() {
    const CF = getModule();
    PluginSandbox = CF.PluginSandbox;
    EventBus = CF.EventBus;
  });

  function fakeFrame() {
    const bus = new EventBus();
    return {
      eventBus: bus,
      store: {
        getCard: () => null, getAllCards: () => [], getCardsByType: () => [],
        getRelationship: () => null, getAllRelationships: () => [],
        addCard: (c) => c, updateCard: (c) => c, removeCard: () => true
      },
      typeRegistry: {
        _types: new Map(),
        register(def) { this._types.set(def.type, def); return true; },
        get(name) { return this._types.get(name); },
        unregister(name) { return this._types.delete(name); }
      },
      themeManager: {
        _themes: new Map(),
        registerTheme(def) { this._themes.set(def.name, def); return true; },
        getTheme(name) { return this._themes.get(name); },
        removeTheme(name) { return this._themes.delete(name); },
        getCurrentTheme: () => 'default'
      },
      i18n: { t: (k) => k, getLocale: () => 'en' }
    };
  }

  it('should expose a restricted context (no circuitBreaker/perf)', function() {
    const sb = new PluginSandbox('p', fakeFrame(), ['*']);
    const ctx = sb.createContext();
    assert.strictEqual(ctx.circuitBreaker, undefined);
    assert.strictEqual(ctx.perf, undefined);
    assert.strictEqual(typeof ctx.setTimeout, 'function');
    assert.strictEqual(typeof ctx.addEventListener, 'function');
  });

  it('should gate store access behind permissions', function() {
    const denied = new PluginSandbox('p', fakeFrame(), []);
    assert.strictEqual(denied.createContext().store, null);
    const granted = new PluginSandbox('p', fakeFrame(), ['store:read']);
    assert.ok(granted.createContext().store);
  });

  it('should track and clear timers on destroy', function(done) {
    const sb = new PluginSandbox('p', fakeFrame(), []);
    const ctx = sb.createContext();
    let fired = false;
    ctx.setTimeout(() => { fired = true; }, 20);
    assert.strictEqual(sb._timers.size, 1);
    sb.destroy();
    assert.strictEqual(sb._timers.size, 0);
    setTimeout(() => { assert.strictEqual(fired, false); done(); }, 40);
  });

  it('should track and clear intervals on destroy', function() {
    const sb = new PluginSandbox('p', fakeFrame(), []);
    const ctx = sb.createContext();
    ctx.setInterval(() => {}, 10);
    assert.strictEqual(sb._intervals.size, 1);
    sb.destroy();
    assert.strictEqual(sb._intervals.size, 0);
  });

  it('should track and remove DOM listeners on destroy', function() {
    const sb = new PluginSandbox('p', fakeFrame(), []);
    const ctx = sb.createContext();
    const el = document.createElement('div');
    let count = 0;
    ctx.addEventListener(el, 'click', () => { count++; });
    assert.strictEqual(sb._domListeners.length, 1);
    sb.destroy();
    el.dispatchEvent(new window.Event('click'));
    assert.strictEqual(count, 0);
  });

  it('should unsubscribe eventBus listeners on destroy', function() {
    const frame = fakeFrame();
    const sb = new PluginSandbox('p', frame, ['events:subscribe']);
    const ctx = sb.createContext();
    let hits = 0;
    ctx.eventBus.on('ping', () => { hits++; });
    frame.eventBus.emit('ping', {});
    assert.strictEqual(hits, 1);
    sb.destroy();
    frame.eventBus.emit('ping', {});
    assert.strictEqual(hits, 1);
  });

  it('should unregister types and themes on destroy', function() {
    const frame = fakeFrame();
    const sb = new PluginSandbox('p', frame, ['types:register', 'theme:read', 'theme:write']);
    const ctx = sb.createContext();
    ctx.typeRegistry.register({ type: 'sb-type' });
    ctx.theme.registerTheme({ name: 'sb-theme' });
    assert.ok(frame.typeRegistry.get('sb-type'));
    assert.ok(frame.themeManager.getTheme('sb-theme'));
    sb.destroy();
    assert.strictEqual(frame.typeRegistry.get('sb-type'), undefined);
    assert.strictEqual(frame.themeManager.getTheme('sb-theme'), undefined);
  });
});

describe('Phase 5 — Plugin Permissions', function() {
  let frame, container;
  afterEach(function() { cleanupFrame(frame, container); frame = null; container = null; });

  it('should install a plugin with no permissions by default', function() {
    ({ frame, container } = createFrame());
    assert.strictEqual(frame.installPlugin({ name: 'np' }), true);
  });

  it('should reject a plugin requesting unauthorized permissions', function() {
    ({ frame, container } = createFrame({ allowedPluginPermissions: ['store:read'] }));
    assert.throws(() => {
      frame.installPlugin({ name: 'bad', permissions: ['store:read', 'store:write'] });
    }, /未授权/);
  });

  it('should allow a plugin within the permission whitelist', function() {
    ({ frame, container } = createFrame({ allowedPluginPermissions: ['store:read', 'store:write'] }));
    assert.strictEqual(frame.installPlugin({ name: 'ok', permissions: ['store:read'] }), true);
  });

  it('should not validate when allowedPluginPermissions is unset (back-compat)', function() {
    ({ frame, container } = createFrame());
    assert.strictEqual(frame.installPlugin({ name: 'legacy', permissions: ['store:write', 'anything'] }), true);
  });

  it('should allow all when whitelist contains "*"', function() {
    ({ frame, container } = createFrame({ allowedPluginPermissions: ['*'] }));
    assert.strictEqual(frame.installPlugin({ name: 'star', permissions: ['store:write'] }), true);
  });
});

describe('Phase 5 — Uninstall Cleanup', function() {
  let frame, container;
  afterEach(function() { cleanupFrame(frame, container); frame = null; container = null; });

  it('should remove registered card types on uninstall', function() {
    ({ frame, container } = createFrame());
    frame.installPlugin({
      name: 'typ',
      cardTypes: [{ type: 'plug-type', label: 'x', propsSchema: [], renderTemplate: '<div></div>' }]
    });
    assert.ok(frame.typeRegistry.get('plug-type'));
    frame.uninstallPlugin('typ');
    assert.strictEqual(frame.typeRegistry.get('plug-type'), undefined);
  });

  it('should remove registered themes on uninstall', function() {
    ({ frame, container } = createFrame());
    frame.installPlugin({
      name: 'thm',
      themes: [{ name: 'plug-theme', variables: {} }]
    });
    assert.ok(frame.themeManager.getTheme('plug-theme'));
    frame.uninstallPlugin('thm');
    assert.ok(!frame.themeManager.getTheme('plug-theme'));
  });

  it('should remove hooks on uninstall', function() {
    ({ frame, container } = createFrame());
    let calls = 0;
    frame.installPlugin({
      name: 'hk',
      hooks: { beforeRender: (d) => { calls++; return d; } }
    });
    frame.pluginManager.triggerHook('beforeRender', {});
    assert.strictEqual(calls, 1);
    frame.uninstallPlugin('hk');
    frame.pluginManager.triggerHook('beforeRender', {});
    assert.strictEqual(calls, 1);
  });

  it('should destroy the sandbox on uninstall', function() {
    ({ frame, container } = createFrame());
    frame.installPlugin({ name: 'sbx' });
    const plugin = frame.pluginManager.plugins.get('sbx');
    const sandbox = plugin.sandbox;
    frame.uninstallPlugin('sbx');
    assert.strictEqual(sandbox._destroyed, true);
  });

  it('should emit pluginUninstalled event', function(done) {
    ({ frame, container } = createFrame());
    frame.installPlugin({ name: 'evt' });
    frame.on('pluginUninstalled', (e) => {
      assert.strictEqual(e.detail.pluginName, 'evt');
      done();
    });
    frame.uninstallPlugin('evt');
  });
});

describe('Phase 5 — Hook Priority', function() {
  let frame, container;
  afterEach(function() { cleanupFrame(frame, container); frame = null; container = null; });

  it('should execute higher-priority hooks first', function() {
    ({ frame, container } = createFrame());
    const order = [];
    frame.installPlugin({ name: 'low', hooks: { h: { priority: 1, handler: (d) => { order.push('low'); return d; } } } });
    frame.installPlugin({ name: 'high', hooks: { h: { priority: 10, handler: (d) => { order.push('high'); return d; } } } });
    frame.pluginManager.triggerHook('h', {});
    assert.deepStrictEqual(order, ['high', 'low']);
  });

  it('should default priority to 0 and keep install order for ties', function() {
    ({ frame, container } = createFrame());
    const order = [];
    frame.installPlugin({ name: 'a', hooks: { h: (d) => { order.push('a'); return d; } } });
    frame.installPlugin({ name: 'b', hooks: { h: (d) => { order.push('b'); return d; } } });
    frame.pluginManager.triggerHook('h', {});
    assert.deepStrictEqual(order, ['a', 'b']);
  });
});

describe('Phase 5 — Plugin Actions', function() {
  let frame, container;
  afterEach(function() { cleanupFrame(frame, container); frame = null; container = null; });

  it('should register and execute a plugin action', function() {
    ({ frame, container } = createFrame());
    frame.installPlugin({
      name: 'act',
      actions: [{ name: 'greet', handler: (f, name) => `hi ${name}` }]
    });
    assert.strictEqual(frame.pluginManager.hasAction('greet'), true);
    assert.strictEqual(frame.executeAction('greet', 'bob'), 'hi bob');
  });

  it('should remove actions on uninstall', function() {
    ({ frame, container } = createFrame());
    frame.installPlugin({ name: 'act2', actions: [{ name: 'ping', handler: () => 'pong' }] });
    frame.uninstallPlugin('act2');
    assert.strictEqual(frame.pluginManager.hasAction('ping'), false);
  });

  it('should return undefined for unknown action', function() {
    ({ frame, container } = createFrame());
    assert.strictEqual(frame.executeAction('nope'), undefined);
  });
});

describe('Phase 5 — Exception Isolation', function() {
  let frame, container;
  afterEach(function() { cleanupFrame(frame, container); frame = null; container = null; });

  it('should continue other hooks when one throws', function() {
    ({ frame, container } = createFrame());
    const order = [];
    frame.installPlugin({ name: 'boom', hooks: { h: { priority: 10, handler: () => { throw new Error('boom'); } } } });
    frame.installPlugin({ name: 'safe', hooks: { h: { priority: 1, handler: (d) => { order.push('safe'); return d; } } } });
    frame.pluginManager.triggerHook('h', {});
    assert.deepStrictEqual(order, ['safe']);
  });

  it('should propagate hook errors via frameworkError with plugin/hook name', function(done) {
    ({ frame, container } = createFrame());
    frame.on('frameworkError', (e) => {
      assert.strictEqual(e.detail.context.hookName, 'h');
      assert.strictEqual(e.detail.context.pluginName, 'boom2');
      done();
    });
    frame.installPlugin({ name: 'boom2', hooks: { h: () => { throw new Error('x'); } } });
    frame.pluginManager.triggerHook('h', {});
  });
});
